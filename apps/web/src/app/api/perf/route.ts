import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, value, rating, delta } = body;
    
    // Log structured Core Web Vitals metric
    console.log(`[WebVitals] Metric: ${name} | ID: ${id} | Value: ${value} | Rating: ${rating} | Delta: ${delta}`);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
