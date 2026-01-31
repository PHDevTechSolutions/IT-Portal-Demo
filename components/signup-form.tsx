"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [userName, setUserName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  // ✅ Animate progress when overlay is active
  useEffect(() => {
    if (showOverlay) {
      let value = 0
      const interval = setInterval(() => {
        value += 10
        setProgress(value)
        if (value >= 100) {
          clearInterval(interval)
          toast.success("Redirecting to login...")
          setTimeout(() => {
            router.push("/Login") // ✅ redirect after success
          }, 800)
        }
      }, 150)
    }
  }, [showOverlay, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userName || !email || !password || !confirmPassword) {
      toast.error("All fields are required!")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match!")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          Email: email,
          Password: password,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success("Registration successful!")
        setShowOverlay(true) // ✅ show overlay animation
      } else {
        toast.error(result.message || "Registration failed!")
      }
    } catch (error) {
      console.error("Signup error:", error)
      toast.error("An error occurred while registering!")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("relative flex flex-col gap-6", className)} {...props}>
      {/* ✅ Overlay Progress Screen */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <h2 className="text-white text-xl font-semibold">
              Creating your account...
            </h2>
            <Progress value={progress} className="w-[70%] mx-auto" />
          </div>
        </div>
      )}

      {/* ✅ Signup Card */}
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center mb-4">
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-muted-foreground text-sm">
                  Enter your details to get started
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="lerouxxchire"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="l@xchire.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      placeholder="6+ characters, 1 capital letter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </Field>
                </div>
              </Field>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </Button>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>

              <div className="grid grid-cols-3 gap-4">
                <Button variant="outline" type="button">
                  🍎 <span className="sr-only">Sign up with Apple</span>
                </Button>
                <Button variant="outline" type="button">
                  🌐 <span className="sr-only">Sign up with Google</span>
                </Button>
                <Button variant="outline" type="button">
                  💬 <span className="sr-only">Sign up with Meta</span>
                </Button>
              </div>

              <FieldDescription className="text-center">
                Already have an account?{" "}
                <Link href="/Login" className="underline hover:text-primary">
                  Sign in
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>

          {/* ✅ Right Side Image */}
          <div className="bg-muted relative hidden md:block">
            <img
              src="/reactmode.jpg"
              alt="Signup image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.3] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center text-sm text-muted-foreground">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline hover:text-primary">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  )
}
