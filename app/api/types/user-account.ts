export interface UserAccount {
  _id: string
  ReferenceID: string
  TSM: string
  TSMName?: string
  Manager: string
  ManagerName?: string
  Location: string
  Firstname: string
  Lastname: string
  Email: string
  Department: string
  Company: string
  Position: string
  Role: string
  Password?: string
  Status: string
  TargetQuota: string
  profilePicture?: string
  Directories?: string[]
  LoginAttempts?: number
  LockUntil?: Date | null
}
