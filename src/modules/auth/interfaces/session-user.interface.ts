import { Role } from "generated/prisma/enums";

export interface SessionUser {
    id: string;
    email: string;
    name: string;
    disabled: boolean;
    role: Role;
    language: string;
}
