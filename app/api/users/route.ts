import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get("currentUserId");
    const search = searchParams.get("search") || "";

    console.log("Users API - currentUserId:", currentUserId);
    console.log("Users API - search:", search);

    if (!currentUserId) {
      return NextResponse.json({ error: "Current user ID is required" }, { status: 400 });
    }

    const db = await connectToDatabase();
    console.log("Users API - connected to database");
    
    // Build search query - only search by department, default to IT
    let query: any = {};
    
    // Exclude current user
    query._id = { $ne: new ObjectId(currentUserId) };
    
    // Default to IT Department, or search specific department
    if (search.trim()) {
      query.Department = { $regex: search, $options: "i" };
    } else {
      // Default to IT Department when no search
      query.Department = "IT";
    }
    
    console.log("Users API - query:", JSON.stringify(query));
    
    // Fetch users from MongoDB
    const users = await db.collection("users")
      .find(query)
      .project({
        password: 0, // Exclude password field
        createdAt: 0, // Exclude sensitive timestamps
        updatedAt: 0
      })
      .sort({ Lastname: 1, Firstname: 1 }) // Sort by Lastname, then Firstname
      .limit(50) // Limit results for performance
      .toArray();

    console.log("Users API - found users:", users.length);
    console.log("Users API - sample user:", users[0]);
    
    // Log all departments for debugging
    const departments = [...new Set(users.map(user => user.Department).filter(Boolean))];
    console.log("Users API - all departments found:", departments);

    // Transform data for frontend - use firstName, lastName, referenceId
    const transformedUsers = users.map(user => {
      console.log("User data:", user);
      
      // Use exact MongoDB field names: Firstname, Lastname, ReferenceID, Department
      const firstName = user.Firstname || 'Unknown';
      const lastName = user.Lastname || 'User';
      const referenceId = user.ReferenceID || user._id.toString();
      const department = user.Department || null;
      
      return {
        id: user._id.toString(),
        referenceId: referenceId,
        firstName: firstName,
        lastName: lastName,
        fullName: `${firstName} ${lastName}`,
        email: user.email || `${referenceId}@company.com`,
        role: user.role || 'user',
        department: department,
        position: user.position || null,
        status: user.status || 'active',
        avatar: user.photoURL || user.avatar || user.profilePicture || null
      };
    });

    console.log("Users API - transformed users:", transformedUsers.length);

    return NextResponse.json({ 
      users: transformedUsers,
      count: transformedUsers.length,
      search: search
    });

  } catch (error) {
    console.error("Users API - Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, referenceId, email, role = 'user', department, position } = body;

    if (!firstName || !lastName || !referenceId) {
      return NextResponse.json({ error: "First name, last name, and reference ID are required" }, { status: 400 });
    }

    const db = await connectToDatabase();
    
    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ referenceId });
    if (existingUser) {
      return NextResponse.json({ error: "User with this reference ID already exists" }, { status: 400 });
    }

    // Create new user
    const newUser = {
      firstName,
      lastName,
      referenceId,
      email: email || `${referenceId}@company.com`,
      role,
      department: department || null,
      position: position || null,
      photoURL: null,
      avatar: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("users").insertOne(newUser);

    return NextResponse.json({
      id: result.insertedId.toString(),
      ...newUser,
      createdAt: newUser.createdAt.toISOString(),
      updatedAt: newUser.updatedAt.toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
