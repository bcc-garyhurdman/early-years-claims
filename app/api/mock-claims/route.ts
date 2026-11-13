import { NextResponse } from "next/server";
import { generateMockClaims } from "@/lib/mock-claims";

// Development stand-in for the third-party API. Point CLAIMS_API_URL at
// http://localhost:3000/api/mock-claims to exercise the HTTP import path.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json(generateMockClaims());
}
