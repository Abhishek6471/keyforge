import urllib.request, urllib.error, json

BASE = "http://localhost:4000"
res = []
def test(name, cond, extra=""):
    res.append((name, cond))
    print(("PASS" if cond else "FAIL"), "-", name, extra if not cond else "")

def req(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE+path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token: r.add_header("Authorization", "Bearer "+token)
    try:
        with urllib.request.urlopen(r) as x:
            raw = x.read().decode()
            return x.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw else {})

# get admin + customer tokens
_, a = req("/api/auth/login", "POST", {"email":"admin@keyforge.test","password":"admin1234"})
atok = a["token"]; test("Admin login returns is_admin=1", a["user"]["is_admin"]==1)
_, c = req("/api/auth/login", "POST", {"email":"demo@keyforge.test","password":"demo1234"})
ctok = c["token"]; test("Customer is_admin=0", c["user"]["is_admin"]==0)

# admin routes blocked for customer
s,_ = req("/api/admin/stats", token=ctok); test("Admin route blocked for customer (403)", s==403, f"got {s}")
s,_ = req("/api/admin/stats"); test("Admin route blocked for anon (401)", s==401, f"got {s}")

# stats
s, st = req("/api/admin/stats", token=atok)
test("GET stats", s==200 and all(k in st for k in ("products","users","orders","revenue")), f"{st}")

# orders list
s, o = req("/api/admin/orders", token=atok)
test("GET all orders (admin) has customer info", s==200 and isinstance(o,list) and (len(o)==0 or "customer_email" in o[0]), f"n={len(o) if isinstance(o,list) else o}")

# create product
s, r = req("/api/admin/products", "POST", {"slug":"test-admin-p","name":"Admin Test Board","category":"keyboard","description":"tmp","price_cents":123400,"image":"/images/nova75.jpg"}, token=atok)
test("POST create product", s==200 and r.get("ok"), f"{r}")
# appears in catalog
_, prods = req("/api/products")
test("New product in public catalog", any(p["slug"]=="test-admin-p" for p in prods))
pid = next((p["id"] for p in prods if p["slug"]=="test-admin-p"), None)

# update product
s, r = req(f"/api/admin/products/{pid}", "PUT", {"slug":"test-admin-p","name":"Admin Test Board v2","category":"keyboard","description":"tmp","price_cents":99900,"image":"/images/nova75.jpg"}, token=atok)
test("PUT update product", s==200 and r.get("ok"), f"{r}")
_, p2 = req("/api/products/test-admin-p")
test("Update persisted (name+price)", p2["name"]=="Admin Test Board v2" and p2["price_cents"]==99900, f"{p2.get('name')} {p2.get('price_cents')}")

# delete product
s, r = req(f"/api/admin/products/{pid}", "DELETE", token=atok)
test("DELETE product", s==200 and r.get("ok"), f"{r}")
_, prods2 = req("/api/products")
test("Product removed from catalog", not any(p["slug"]=="test-admin-p" for p in prods2))

# create order as customer, then admin changes status
req("/api/cart", "POST", {"productId":1,"qty":1}, ctok)
_, co = req("/api/checkout", "POST", token=ctok)
oid = co.get("orderId")
s, o2 = req("/api/admin/orders", token=atok)
test("New order visible to admin", any(x["id"]==oid for x in o2), f"oid={oid}")
s, r = req(f"/api/admin/orders/{oid}", "PUT", {"status":"shipped"}, token=atok)
test("Update order status", s==200 and r.get("status")=="shipped", f"{r}")
_, o3 = req("/api/admin/orders", token=atok)
test("Status change persisted", next(x["status"] for x in o3 if x["id"]==oid)=="shipped")

# invalid status rejected
s, r = req(f"/api/admin/orders/{oid}", "PUT", {"status":"bogus"}, token=atok)
test("Invalid status rejected (400)", s==400, f"got {s}")

# users list
s, u = req("/api/admin/users", token=atok)
test("GET users list", s==200 and isinstance(u,list) and len(u)>=2 and "order_count" in u[0], f"n={len(u) if isinstance(u,list) else u}")

print("\n=== SUMMARY ===")
p = sum(1 for _,c in res if c)
print(f"{p}/{len(res)} passed")