import { describe, expect, it } from "vitest";
import { parseRegistry } from "./CapabilityCatalog";
import registry from "../../public/parties.json";

describe("runtime party enrollment", () => {
  const external = {...registry.parties[0], id:"example-issuer", endpoint:"https://issuer.example", evidenceTier:"registered only", evidence:null};
  it("enrolls an external HTTPS issuer with no adapter or evidence claim", () => {
    expect(parseRegistry({...registry, parties:[...registry.parties,external]})).toContainEqual(external);
  });
  it.each(["https://name:pass@issuer.example","https://issuer.example/?code=secret","http://issuer.example","javascript:alert(1)"])("rejects unsafe public endpoint %s", endpoint => {
    expect(()=>parseRegistry({...registry,parties:[{...external,endpoint}]})).toThrow();
  });
  it("rejects duplicate IDs and unsupported claims of proof", () => {
    expect(()=>parseRegistry({...registry,parties:[external,external]})).toThrow();
    expect(()=>parseRegistry({...registry,parties:[{...external,evidenceTier:"real wallet"}]})).toThrow();
  });
});
