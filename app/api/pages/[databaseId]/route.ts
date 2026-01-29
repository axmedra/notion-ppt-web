import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotionClient, getDatabasePages } from "@/lib/notion";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) => {
  const session = await auth();
  const { databaseId } = await params;

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notion = createNotionClient(session.accessToken);
    const pages = await getDatabasePages(notion, databaseId);

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("Error fetching pages:", error);
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
};
