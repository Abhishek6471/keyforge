import urllib.request, urllib.error, json

B = "http://localhost:4000"
def req(p, m="GET", b=None, t=None):
    d = json.dumps(b).encode() if b is not None else None
    r = urllib.request.Request(B+p, data=d, method=m)
    r.add_header("Content-Type", "application/json")
    if t: r.add_header("Authorization", "Bearer "+t)
    try:
        with urllib.request.urlopen(r) as x:
            raw = x.read().decode()
            return x.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw else {})

_, d = req("/api/auth/login", "POST", {"email":"demo@keyforge.test","password":"demo1234"})
tok = d["token"]

# add Nova75 with brass(+4500) clicky(+500) premium(+3500) x2
req("/api/cart", "POST", {"productId":1,"config":{"cases":"brass","switches":"clicky","keycaps":"premium"},"qty":2}, tok)
_, cart = req("/api/cart", t=tok)
disp = sum(i["product"]["price_cents"]*i["qty"] for i in cart)
base = 18900; addons = 4500+500+3500
exp = (base+addons)*2
print("cart displayed:", disp, "| expected configured:", exp, "->", "MATCH" if disp==exp else "MISMATCH")

s, co = req("/api/checkout", "POST", t=tok)
print("checkout total:", co.get("total"), "| expected:", exp, "->", "MATCH" if co.get("total")==exp else "MISMATCH")

_, o = req("/api/orders", t=tok)
line = o[0]["items"][0]["price_cents"]
print("order line unit price:", line, "| expected:", base+addons, "->", "MATCH" if line==base+addons else "MISMATCH")