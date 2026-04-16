import { describe, it, expect } from "vitest";
import { CreateProjectSchema, UpdateProjectSchema } from "../project.schema.js";

describe("CreateProjectSchema", () => {
  it("accepts valid input", () => {
    const result = CreateProjectSchema.parse({ name: "Hello", description: "Desc" });
    expect(result.name).toBe("Hello");
  });

  it("rejects empty name", () => {
    expect(() => CreateProjectSchema.parse({ name: "" })).toThrow();
  });

  it("description is optional", () => {
    const result = CreateProjectSchema.parse({ name: "No desc" });
    expect(result.description).toBeUndefined();
  });
});

describe("UpdateProjectSchema", () => {
  it("allows partial updates", () => {
    const result = UpdateProjectSchema.parse({ name: "New name" });
    expect(result.name).toBe("New name");
  });

  it("accepts empty object", () => {
    const result = UpdateProjectSchema.parse({});
    expect(result.name).toBeUndefined();
  });
});
