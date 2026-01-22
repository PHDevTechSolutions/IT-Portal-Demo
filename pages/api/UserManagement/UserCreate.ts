import { NextApiRequest, NextApiResponse } from "next"
import { connectToDatabase } from "@/lib/MongoDB"
import bcrypt from "bcrypt"

// 🧩 Helper to generate ReferenceID
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
        const db = await connectToDatabase()
        const users = db.collection("users")

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
        } = req.body

        // 🧾 Validate required fields
        if (!Firstname || !Lastname || !Email || !Password || !Location) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields.",
            })
        }

        // 🚫 Check for existing email
        const existing = await users.findOne({ Email })
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Email already exists.",
            })
        }

        // 🔒 Hash password
        const hashed = await bcrypt.hash(Password, 10)

        // 🆔 Generate ReferenceID
        const finalReferenceID = generateReferenceID(Firstname, Lastname, Location)

        // 🧍 Build new user object
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
            Directories: Array.isArray(Directories) ? Directories : [], // ensure array
        }

        // 🧩 Include Manager + TSM if department is Sales
        if (Department === "Sales") {
            newUser.Manager = Manager || null
            newUser.TSM = TSM || null
        }

        // 💾 Save to database
        const result = await users.insertOne(newUser)

        // Huwag isama password sa response
        const userToReturn = { ...newUser }
        delete userToReturn.Password

        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: { _id: result.insertedId, ...userToReturn },
        })
    } catch (error) {
        console.error("Create User Error:", error)
        res.status(500).json({
            success: false,
            message: "Server error creating user",
        })
    }
}
