import urllib.request, urllib.error, json, random

BASE = "http://localhost:4000"
results = []
def test(name, cond, extra=""):
    results.append((name, cond, extra))
    print(("PASS" if cond else "FAIL"), "-", name, extra if not cond else "")

def req(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE+path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token: r.add_header("Authorization", "Bearer "+token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

# 1. Public product listing
s, d = req("/api/products")
test("GET /api/products returns 200 + 12 items", s==200 and len(d)==12, f"status={s} len={len(d) if isinstance(d,list) else d}")

# 2. Category filter
s, d = req("/api/products?category=keyboard")
test("Filter category=keyboard", s==200 and all(p["category"]=="keyboard" for p in d) and len(d)>0, f"{len(d) if isinstance(d,list) else d}")

# 3. Search
s, d = req("/api/products?q=nova")
test("Search q=nova", s==200 and any("Nova" in p["name"] for p in d), f"{len(d) if isinstance(d,list) else d}")

# 4. Single product by slug
s, d = req("/api/products/nova75")
test("GET product by slug (has config)", s==200 and d.get("config") is not None, str(d.get("name")))

# 5. Nonexistent product -> 404
s, d = req("/api/products/does-not-exist")
test("Nonexistent product returns 404", s==404, f"status={s}")

# 6. Register validation: short password
s, d = req("/api/auth/register", "POST", {"name":"T","email":"t@t.com","password":"123"})
test("Register rejects short password (400)", s==400, f"status={s}")

# 7. Register missing fields
s, d = req("/api/auth/register", "POST", {"name":"T"})
test("Register rejects missing fields (400)", s==400, f"status={s}")

# 8. Register valid user
email = f"qa{random.randint(1000,9999)}@test.com"
s, d = req("/api/auth/register", "POST", {"name":"QA Tester","email":email,"password":"secret123"})
test("Register valid user returns token", s==200 and "token" in d, f"status={s} {d.get('error','')}")

# 9. Duplicate email
s, d = req("/api/auth/register", "POST", {"name":"X","email":email,"password":"secret123"})
test("Duplicate email rejected (409)", s==409, f"status={s}")

# 10. Login wrong password
s, d = req("/api/auth/login", "POST", {"email":email,"password":"wrongpass"})
test("Wrong password rejected (401)", s==401, f"status={s}")

# 11. Login correct
s, d = req("/api/auth/login", "POST", {"email":email,"password":"secret123"})
test("Login correct returns token", s==200 and "token" in d, f"status={s}")
tok = d.get("token")

# 12. Cart requires auth
s, d = req("/api/cart")
test("Cart without token rejected (401)", s==401, f"status={s}")

# Clear any leftover cart from previous runs
_, _cur = req("/api/cart", token=tok)
for _i in (_cur if isinstance(_cur, list) else []):
    req(f"/api/cart/{_i['cartId']}", "DELETE", token=tok)

# 13. Add to cart (keyboard with config)
s, d = req("/api/cart", "POST", {"productId":1,"config":{"cases":"brass","switches":"clicky","keycaps":"premium"},"qty":2}, tok)
test("Add to cart", s==200 and d.get("ok"), f"status={s} {d}")

# 14. Add second item
s, d = req("/api/cart", "POST", {"productId":9,"qty":1}, tok)
test("Add second item (no config)", s==200, f"status={s}")

# 15. View cart
s, d = req("/api/cart", token=tok)
test("View cart has 2 items", s==200 and len(d)==2, f"{len(d) if isinstance(d,list) else d}")

# 16. Cart total incl. config add-ons (read add-ons dynamically from product config)
_, _p1 = req("/api/products/nova75")
base = _p1["price_cents"]
def addon(cfg, group, opt_id):
    return next(o["add_cents"] for o in cfg[group] if o["id"] == opt_id)
_c = _p1["config"]
ADD_B = addon(_c, "cases", "brass")
ADD_CL = addon(_c, "switches", "clicky")
ADD_P = addon(_c, "keycaps", "premium")
line1 = (base + ADD_B + ADD_CL + ADD_P) * 2
_, _p9 = req("/api/products/artisan-panda")
line2 = _p9["price_cents"] * 1
expected = line1 + line2
cart_total = sum(i["unit_price"]*i["qty"] for i in d)
test("Cart total correct (config add-ons counted)", cart_total==expected, f"got={cart_total} expected={expected}")

# 17. Remove item (remove product 9 line = the one without config)
target = next(i for i in d if i["config"] is None)
s, d = req(f"/api/cart/{target['cartId']}", "DELETE", token=tok)
s2, d2 = req("/api/cart", token=tok)
test("Remove from cart works", s==200 and len(d2)==1, f"after={len(d2) if isinstance(d2,list) else d2}")

# 18. Checkout total must equal the remaining configured cart total
expected_after = sum(i["unit_price"]*i["qty"] for i in d2)
s, d = req("/api/checkout", "POST", token=tok)
test("Checkout creates order (add-ons included)", s==200 and d.get("orderId") and d.get("total")==expected_after, f"got={d.get('total')} expected={expected_after} {d.get('error','')}")

# 19. Cart cleared after checkout
s, d = req("/api/cart", token=tok)
test("Cart cleared after checkout", len(d)==0, f"{len(d) if isinstance(d,list) else d}")

# 20. Order history
s, d = req("/api/orders", token=tok)
test("Order history shows the order", s==200 and len(d)==1 and d[0]["items"], f"{len(d) if isinstance(d,list) else d}")

# 21. Checkout with empty cart
s, d = req("/api/checkout", "POST", token=tok)
test("Checkout empty cart rejected (400)", s==400, f"status={s}")

# 22. Invalid token
s, d = req("/api/cart", token="garbage.token.here")
test("Invalid token rejected (401)", s==401, f"status={s}")

# 23. Frontend served
import urllib.request as u
html = u.urlopen(BASE+"/").read().decode()
test("Frontend index.html served", "root" in html and "KeyForge" in html)

print("\n=== SUMMARY ===")
p = sum(1 for _,c,_ in results if c)
print(f"{p}/{len(results)} passed")