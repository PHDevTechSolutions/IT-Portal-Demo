import { NextApiRequest, NextApiResponse } from "next"
import { supabase } from "@/utils/supabase"
import bcrypt from "bcrypt"
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit"

// Helper to get actor from request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  return {
    uid: req.headers["x-user-id"] as string || null,
    email: req.headers["x-user-email"] as string || "system",
    role: req.headers["x-user-role"] as string || "unknown",
    name: req.headers["x-user-name"] as string || null,
  }
}

// Helper to extract IP and User Agent from request
function getRequestContext(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"]
  const ip = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.socket.remoteAddress || "unknown"
  
  return {
    ipAddress: ip,
    userAgent: req.headers["user-agent"] || null,
  }
}

// Helper to generate ReferenceID
function generateReferenceID(firstname: string, lastname: string, location: string) {
    if (!firstname || !lastname || !location) return ""
    const initials = firstname[0].toUpperCase() + lastname[0].toUpperCase()
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    return `${initials}-${location}-${randomNum}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"])
        return res.status(405).json({
            success: false,
            message: `Method ${req.method} not allowed`,
        })
    }

    try {
        const {
            Firstname,
            Lastname,
            Email,
            Department,
            Company,
            Position,
            Role,
            Password,
            Status,
            TargetQuota,
            Location,
            Manager,
            TSM,
            ReferenceID, // optional
            Directories, // <- dito natin idadagdag
            ManagerName,
            TSMName,
            ContactNumber,
            profilePicture,
            Address,
            AnotherNumber,
            Birthday,
            Gender,
            OtherEmail,
            Connection,
            signatureImage,
            SecondaryEmail,
            pin,
            registrationMethod,
            twoFactorEnabled,
            otp,
            otpExpiry,
            permissions,
            credentials,
            faceDescriptors,
            faceVerificationEnabled,
            DeviceId,
        } = req.body

        // Validate required fields
        if (!Firstname || !Lastname || !Email || !Password || !Location) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields.",
            })
        }

        // Check for existing email
        const { data: existing, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('Email', Email);
        
        if (fetchError) throw fetchError;

        if (existing && existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already exists.",
            })
        }

        // Hash password
        const hashed = await bcrypt.hash(Password, 10)

        // Generate ReferenceID
        const finalReferenceID = generateReferenceID(Firstname, Lastname, Location)

        // Build new user object — only include fields that exist in the Supabase schema
        const newUser: any = {
            Firstname,
            Lastname,
            Email,
            Department,
            Company,
            Position,
            Role,
            Location,
            ReferenceID: finalReferenceID,
            Password: hashed,
            Status: Status || "Active",
            TargetQuota: Department === "Sales" ? TargetQuota || null : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ManagerName,
            TSMName,
            ContactNumber,
            profilePicture,
            Address,
            AnotherNumber,
            Birthday,
            Gender,
            OtherEmail,
            Connection,
            signatureImage,
            SecondaryEmail,
            pin,
            registrationMethod,
            twoFactorEnabled: twoFactorEnabled || false,
            otp,
            otpExpiry,
            permissions: permissions || null,
            credentials: credentials || null,
            faceDescriptors: faceDescriptors || null,
            faceVerificationEnabled: faceVerificationEnabled || false,
            DeviceId,
        }

        // Include Manager + TSM if department is Sales
        if (Department === "Sales") {
            newUser.Manager = Manager || null
            newUser.TSM = TSM || null
        }

        // Try to include Directories — if column doesn't exist, skip it
        if (Array.isArray(Directories) && Directories.length > 0) {
            newUser.Directories = Directories
        }

        // Save to Supabase — if Directories column missing, retry without it
        let insertError: any = null;

        const { error: err1 } = await supabase.from('users').insert([newUser]);
        if (err1) {
            if (err1.message?.includes("Directories")) {
                // Column doesn't exist yet — insert without it
                const { Directories: _omit, ...userWithoutDirs } = newUser;
                const { error: err2 } = await supabase.from('users').insert([userWithoutDirs]);
                insertError = err2;
            } else {
                insertError = err1;
            }
        }

        if (insertError) throw insertError;

        // Log audit after successful creation (non-blocking — don't fail creation if audit fails)
        try {
          const actor = getActorFromRequest(req)
          const { ipAddress, userAgent } = getRequestContext(req)
          const targetUserName = `${Firstname} ${Lastname}`
          const actorName = actor.name || actor.email || 'Unknown'
          await logSystemAudit({
            action: "create",
            module: "UserManagement",
            page: "/admin/roles",
            resourceType: "user",
            resourceId: finalReferenceID,
            resourceName: `${targetUserName} (created by: ${actorName})`,
            actor,
            ipAddress,
            userAgent,
            source: "UserCreateAPI",
            metadata: {
              targetUser: targetUserName,
              targetEmail: Email,
              targetRole: Role,
              targetDepartment: Department,
              targetPosition: Position,
            },
          })
        } catch (auditErr) {
          console.warn("Audit log failed (non-fatal):", auditErr)
        }

        // Huwag isama password sa response
        const userToReturn = { ...newUser, _id: finalReferenceID }
        delete userToReturn.Password

        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: userToReturn,
        })
    } catch (error: any) {
        console.error("Create User Error:", error)
        res.status(500).json({
            success: false,
            message: error?.message || "Server error creating user",
        })
    }
}
