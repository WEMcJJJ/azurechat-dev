import { AlertTriangle, Settings } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth-page/helpers";

interface ModelSetupRequiredProps {
  message: string;
}

export async function ModelSetupRequired({ message }: ModelSetupRequiredProps) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="space-y-4">
          <AlertTriangle className="w-20 h-20 text-orange-500 mx-auto" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Setup Required
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
        </div>

        {user.isAdmin ? (
          <div className="space-y-6">
            <p className="text-gray-700 dark:text-gray-300">
              As an administrator, you can configure AI models to enable chat functionality.
            </p>
            <Link
              href="/admin/models"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
            >
              <Settings className="w-5 h-5" />
              Configure Models
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Please contact your administrator to set up AI models for this application.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Chat functionality will be available once models are configured.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
