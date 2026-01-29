import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserDatabases } from "@/lib/notion";

export const GET = async () => {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const databases = await getUserDatabases(session.accessToken);

    return NextResponse.json({ databases });
  } catch (error) {
    console.error("Error fetching databases:", error);
    return NextResponse.json(
      { error: "Failed to fetch databases" },
      { status: 500 }
    );
  }
};
