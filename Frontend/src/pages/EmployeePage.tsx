import UserPage from "./UserPage";

export default function EmployeePage() {
  return (
    <UserPage
      expectedProfileType="employee"
      roleLabel="Colaboradora"
      simplifiedNavigation
      simplifiedPersonalData
      simplifiedSecurity
      securityOnlyDeactivation
    />
  );
}
