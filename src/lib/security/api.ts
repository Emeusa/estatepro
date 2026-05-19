import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown) {
  return schema.parse(body);
}

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { message: error.message, fields: error.fields },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json({ message: "Invalid request payload." }, { status: 400 });
  }

  return NextResponse.json(
    { message: error instanceof Error ? error.message : fallback },
    { status: 400 }
  );
}
