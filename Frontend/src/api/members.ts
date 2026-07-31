export type CompanyMember = { employeeId:number; userId:number; username:string; displayName:string; fullName:string; companyRole:"owner"|"employee"; isArchitect:boolean };
export type CreateCompanyMember = { username:string; password:string; displayName:string; fullName:string; companyRole:"owner"|"employee"; isArchitect:boolean };
async function request<T>(path:string, init?:RequestInit):Promise<T>{ const r=await fetch(`/api/company/members${path}`,init); const b=r.headers.get("content-type")?.includes("application/json")?await r.json():null; if(!r.ok) throw new Error(b?.error ?? (r.status===403?"Não tens permissão para gerir membros.":"Não foi possível concluir o pedido.")); return b as T; }
export const loadMembers=()=>request<CompanyMember[]>("/");
export const createMember=(body:CreateCompanyMember)=>request<CompanyMember>("/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
export const updateMember=(id:number,body:Pick<CompanyMember,"companyRole"|"isArchitect">)=>request<CompanyMember>(`/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
export const deactivateMember=(id:number)=>request<void>(`/${id}`,{method:"DELETE"});
