import { PortabilityHub } from "../../../../../components/portability-hub";
export default async function Page({params}:{params:Promise<{workspaceId:string}>}){const{workspaceId}=await params;return <PortabilityHub workspaceId={workspaceId}/>;}
