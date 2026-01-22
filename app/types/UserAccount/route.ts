export interface UserAccount {
  _id: string
  ReferenceID: string
  TSM: string
  Manager: string
  Location: string
  Firstname: string
  Lastname: string
  Email: string
  Department: string
  Company: string
  Position: string
  Role: string
  Password: string
  Status: string
  TargetQuota: string
  profilePicture?: string
  Directories?: string[]
}
