export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRequest {
  name: string;
  email: string;
  phone?: string;
}
