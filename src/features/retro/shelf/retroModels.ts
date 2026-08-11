export type PostalPs1NodeRole = "front-artwork" | "back-artwork" | "disc" | "case";

export function classifyPostalPs1Node(
  nodeName: string,
  materialName: string,
): PostalPs1NodeRole {
  if (nodeName.includes("Object_2") || materialName === "Material__28") return "front-artwork";
  if (nodeName.includes("Object_5") || materialName === "Material__26") return "back-artwork";
  if (
    nodeName.includes("Object_3")
    || nodeName.includes("Object_10")
    || materialName === "Material__97"
    || materialName === "Material__99"
  ) return "disc";
  return "case";
}
