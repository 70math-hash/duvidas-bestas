#!/usr/bin/env python3
"""Confere a planilha QT-massa-biga.xlsx recalculando tudo em Python.

O recalc do LibreOffice só prova que as fórmulas avaliam. Este script prova
que elas respondem a pergunta certa: recompõe a receita a partir dos inputs
e compara célula a célula com o que ficou em cache. Falha com AssertionError.
"""
from openpyxl import load_workbook

P = "/home/user/duvidas-bestas/fichas/QT-massa-biga.xlsx"
v = load_workbook(P, data_only=True)
m, t = v["Massa"], v["Três braços"]

ok = 0


def eq(nome, obtido, esperado, tol=0.05):
    global ok
    assert obtido is not None, f"{nome}: célula vazia, recalc não rodou"
    assert abs(obtido - esperado) <= tol, f"{nome}: obtido {obtido}, esperado {esperado}"
    print(f"  ok  {nome:<52} {obtido:,.2f}")
    ok += 1


# ---- inputs ----
bolas, peso, perda = m["B10"].value, m["B11"].value, m["B12"].value
hid, sal, ferm, bpct, hbiga = (m[c].value for c in ("B16", "B17", "B18", "B19", "B20"))
mar_b, vio_b, ver_b = (m[c].value for c in ("B27", "B28", "B29"))
mar_r, vio_r, ver_r = (m[c].value for c in ("C27", "C28", "C29"))

# ---- recomposição independente ----
massa = bolas * peso * (1 + perda)
F = massa / (1 + hid + sal + bpct * ferm)
agua_biga = F * bpct * hbiga
agua_rinf = F * hid - agua_biga
farinha_rinf = F * (1 - bpct)
total_biga = F * (mar_b + vio_b + ver_b) + agua_biga + F * bpct * ferm
total_massa = total_biga + F * (mar_r + vio_r + ver_r) + agua_rinf + F * sal

print("ABA MASSA")
eq("massa total pedida", m["B13"].value, massa)
eq("farinha total", m["B21"].value, F)
eq("água total", m["B22"].value, F * hid)
eq("sal total", m["B23"].value, F * sal)
eq("blend, soma na biga", m["B30"].value, bpct, 1e-9)
eq("blend, soma no rinfresco", m["C30"].value, 1 - bpct, 1e-9)
eq("blend, soma geral", m["D30"].value, 1.0, 1e-9)
eq("água da biga", m["B38"].value, agua_biga)
eq("fermento", m["B39"].value, F * bpct * ferm)
eq("total da biga", m["B40"].value, total_biga)
eq("água do rinfresco", m["B49"].value, agua_rinf)
eq("total da massa", m["B51"].value, total_massa)
eq("fecha com a massa pedida", m["B55"].value, 0.0, 0.01)
eq("hidratação sobre a farinha do rinfresco", m["B56"].value, agua_rinf / farinha_rinf, 1e-6)
eq("fermento em % da farinha total", m["B58"].value, bpct * ferm, 1e-9)
eq("peso de bola conferido", m["B59"].value, peso, 0.01)

for cel, trecho in (("A31", "Blend fecha"), ("A60", "viável")):
    txt = m[cel].value or ""
    assert trecho in txt, f"{cel}: mensagem inesperada -> {txt!r}"
    print(f"  ok  validação {cel:<44} {txt[:44]}")
    ok += 1

print("\nABA TRÊS BRAÇOS")
for col, nome in (("B", "A · 45%"), ("C", "B · 55%"), ("D", "C · 65%")):
    hb, fb = t[f"{col}7"].value, t[f"{col}8"].value
    Fb = massa / (1 + hid + sal + bpct * fb)
    ab = Fb * bpct * hb
    ar = Fb * hid - ab
    tb = Fb * (mar_b + vio_b + ver_b) + ab + Fb * bpct * fb
    tm = tb + Fb * (mar_r + vio_r + ver_r) + ar + Fb * sal
    eq(f"{nome} · total da biga", t[f"{col}17"].value, tb)
    eq(f"{nome} · total da massa", t[f"{col}23"].value, tm)
    eq(f"{nome} · total bate com o pedido", t[f"{col}23"].value, massa, 0.02)
    eq(f"{nome} · água na biga", t[f"{col}28"].value, ab)
    eq(f"{nome} · água no rinfresco", t[f"{col}29"].value, ar)
    eq(f"{nome} · hidratação da farinha do rinfresco",
       t[f"{col}27"].value, ar / (Fb * (1 - bpct)), 1e-6)

# a aba Massa com a mesma hidratação da coluna B tem que dar o mesmo resultado
eq("coerência entre abas, biga a 55%", t["C23"].value, m["B51"].value, 0.02)

print(f"\n{ok} conferências, todas certas. A planilha reproduz a receita da QT.")
