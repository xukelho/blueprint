import UserPage, { UserPageProfile } from "./UserPage";

const clientProfile: UserPageProfile = {
  initials: "MS",
  name: "Marta Silva",
  fullName: "Marta Isabel Silva",
  roleLabel: "Cliente",
  organization: "Casa do Vale",
  email: "marta.silva@email.pt",
  phone: "+351 912 345 678",
  website: "",
  address: "Rua do Pinhal, 14 · 2925-468 Azeitão",
  linkedIn: "",
  instagram: "",
};

export default function ClientPage() {
  return <UserPage profile={clientProfile} />;
}
