import { hasRole, ARCHITECT_ROLE } from "../auth";
import UserPage, { UserPageProfile } from "./UserPage";

const employeeProfile: UserPageProfile = {
  initials: "AM",
  name: "Ana Martins",
  fullName: "Ana Sofia Martins",
  roleLabel: "Colaboradora",
  organization: "Forma Norte",
  email: "ana.martins@formanorte.pt",
  phone: "+351 916 204 885",
  website: "https://anamartins.pt",
  address: "Rua do Alecrim, 45 · 1200-014 Lisboa",
  linkedIn: "linkedin.com/in/anamartins",
  instagram: "@ana.martins.arq",
};

export default function EmployeePage() {
  const profile = hasRole(ARCHITECT_ROLE)
    ? { ...employeeProfile, additionalRoleLabels: ["Arquiteta"] }
    : employeeProfile;
  return <UserPage profile={profile} />;
}
