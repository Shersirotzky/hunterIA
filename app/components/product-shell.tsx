import { PwaRegister } from "./pwa-register";
import { ProductNav } from "./product-nav";

export async function ProductShell({ children }: { children: React.ReactNode }) { return <><PwaRegister /><ProductNav /><div className="product-shell">{children}</div></>; }
