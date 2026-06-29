// Supabase Edge Function: admin-users
// 用户管理：创建、删除、批量操作

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req: Request) => {
  try {
    // 获取请求体
    const body = await req.json()
    const { action, employee_no, username, password, role, user_id, user_ids, users } = body

    // 创建 Supabase Admin 客户端（使用 service_role key）
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 验证请求来源（从 Authorization header 获取用户）
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "未授权" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    }

    // 使用普通客户端验证当前用户是否为管理员
    const token = authHeader.replace("Bearer ", "")
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!)
    
    // 设置用户 session
    const { data: { user: currentUser }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !currentUser) {
      return new Response(JSON.stringify({ error: "认证失败" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    }

    // 检查是否为管理员
    const { data: userProfile } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", currentUser.id)
      .single()

    const isAdmin = userProfile?.role === "admin" || currentUser.email === "admin@admin.com"
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "无权限执行此操作" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      })
    }

    // 处理不同操作
    switch (action) {
      case "create": {
        // 创建单个用户
        if (!employee_no || !username) {
          return new Response(JSON.stringify({ error: "工号和姓名不能为空" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        const email = employee_no.toLowerCase().trim() + "@system.local"
        const userPassword = password || "123456"
        const userRole = role || "user"

        // 检查工号是否已存在
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("employee_no", employee_no.trim())
          .single()

        if (existingUser) {
          return new Response(JSON.stringify({ error: "工号已存在" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        // 使用 Admin API 创建用户
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: userPassword,
          email_confirm: true,
          user_metadata: {
            username: username.trim(),
            employee_no: employee_no.trim()
          }
        })

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        // 同步到 public.users 表
        await supabase.from("users").insert({
          id: newUser.user.id,
          email: email,
          username: username.trim(),
          employee_no: employee_no.trim(),
          role: userRole
        })

        return new Response(JSON.stringify({
          success: true,
          user: {
            id: newUser.user.id,
            email: email,
            username: username.trim(),
            employee_no: employee_no.trim(),
            role: userRole
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      }

      case "batch_create": {
        // 批量创建用户
        if (!users || users.length === 0) {
          return new Response(JSON.stringify({ error: "用户列表不能为空" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        let successCount = 0
        let failedCount = 0
        const errors: string[] = []

        for (const u of users) {
          try {
            const empNo = u.employee_no?.trim()
            const uname = u.username?.trim()
            const pwd = u.password || "123456"
            const r = u.role || "user"

            if (!empNo || !uname) {
              failedCount++
              errors.push(`${empNo || "未知"}: 工号或姓名为空`)
              continue
            }

            const email = empNo.toLowerCase() + "@system.local"

            // 检查是否存在
            const { data: existing } = await supabase
              .from("users")
              .select("id")
              .eq("employee_no", empNo)
              .single()

            if (existing) {
              failedCount++
              errors.push(`${empNo}: 工号已存在`)
              continue
            }

            // 创建用户
            const { data: newUser, error: err } = await supabase.auth.admin.createUser({
              email: email,
              password: pwd,
              email_confirm: true,
              user_metadata: { username: uname, employee_no: empNo }
            })

            if (err) {
              failedCount++
              errors.push(`${empNo}: ${err.message}`)
              continue
            }

            // 同步到 public.users
            await supabase.from("users").insert({
              id: newUser.user.id,
              email: email,
              username: uname,
              employee_no: empNo,
              role: r
            })

            successCount++
          } catch (e) {
            failedCount++
            errors.push(`${u.employee_no || "未知"}: ${e.message}`)
          }
        }

        return new Response(JSON.stringify({
          success: successCount,
          failed: failedCount,
          errors: errors
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      }

      case "delete": {
        // 删除单个用户
        if (!user_id) {
          return new Response(JSON.stringify({ error: "用户ID不能为空" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        // 不能删除自己
        if (user_id === currentUser.id) {
          return new Response(JSON.stringify({ error: "不能删除当前登录的管理员账号" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        // 使用 Admin API 删除用户
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id)

        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      }

      case "batch_delete": {
        // 批量删除用户
        if (!user_ids || user_ids.length === 0) {
          return new Response(JSON.stringify({ error: "用户ID列表不能为空" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        let successCount = 0
        let failedCount = 0
        const errors: string[] = []

        for (const uid of user_ids) {
          try {
            if (uid === currentUser.id) {
              failedCount++
              errors.push("不能删除当前登录的管理员账号")
              continue
            }

            const { error: err } = await supabase.auth.admin.deleteUser(uid)
            if (err) {
              failedCount++
              errors.push(`${uid}: ${err.message}`)
            } else {
              successCount++
            }
          } catch (e) {
            failedCount++
            errors.push(`${uid}: ${e.message}`)
          }
        }

        return new Response(JSON.stringify({
          success: successCount,
          failed: failedCount,
          errors: errors
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      }

      default:
        return new Response(JSON.stringify({ error: "未知操作" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})