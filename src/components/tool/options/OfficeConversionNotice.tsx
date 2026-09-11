import { BackendStatusNotice } from "@/components/tool/office/BackendStatusNotice";

export function OfficeConversionNotice({ toolName }: { toolName: string }) {
  return <BackendStatusNotice status={null} toolName={toolName} />;
}
