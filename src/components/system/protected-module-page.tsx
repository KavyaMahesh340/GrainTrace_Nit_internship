import { ModulePage } from "@/components/system/module-page";
import { requirePermission } from "@/lib/auth/access";
import type { Permission } from "@/lib/auth/permissions";
import { referenceSchema } from "@/lib/auth/validation";

type ProtectedModulePageProps = {
  permission: Permission;
  code: string;
  title: string;
  description: string;
  focusLabel?: string;
  focusValue?: string;
};

export async function ProtectedModulePage({
  permission,
  ...props
}: ProtectedModulePageProps) {
  requirePermission(permission);
  const parsedFocus = props.focusValue ? referenceSchema.safeParse(props.focusValue) : null;

  return (
    <ModulePage
      {...props}
      focusValue={parsedFocus?.success ? parsedFocus.data : undefined}
    />
  );
}
