import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Lightbulb } from "lucide-react";

interface PlaceholderProps {
  userRole: "admin" | "branch";
}

export default function Placeholder({ userRole }: PlaceholderProps) {
  const { page } = useParams();
  const pageName = page
    ?.split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <AdminLayout userRole={userRole}>
      <div className="space-y-8">
        <Link
          to={userRole === "admin" ? "/admin/dashboard" : "/branch/dashboard"}
        >
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="flex flex-col items-center justify-center min-h-96">
          <Card className="w-full max-w-md">
            <CardContent className="pt-12">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <Lightbulb className="w-12 h-12 text-primary" />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {pageName || "Coming Soon"}
                  </h2>
                  <p className="text-slate-600 mt-2">
                    This section is ready to be developed. Tell me what features
                    you'd like to add here and I'll implement them for you.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left text-sm">
                  <p className="font-semibold text-blue-900 mb-2">
                    💡 Next Steps:
                  </p>
                  <ul className="text-blue-800 space-y-1 list-disc list-inside">
                    <li>Describe the features you need</li>
                    <li>Mention any specific fields or data</li>
                    <li>I'll implement and integrate them</li>
                  </ul>
                </div>

                <Link
                  to={
                    userRole === "admin"
                      ? "/admin/dashboard"
                      : "/branch/dashboard"
                  }
                >
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}




