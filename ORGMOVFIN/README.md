# 💰 FinFlow

Sistema de administración de finanzas personales — PWA ligera y offline-first.

## Funcionalidades

- **Dashboard** con balance total en MXN, USD y EUR
- **Registro de movimientos** (ingresos, gastos, cambio de divisas)
- **Historial** filtrable por rango de fechas
- **Deudas** con seguimiento de abonos y progreso
- **Metas de ahorro** con sub-metas, contribuciones y fecha límite
- **Comisiones semanales** por ventas
- **Presupuestos mensuales** por categoría
- **Conciliación / Arqueo** de cuentas físicas vs. digitales
- **Categorías dinámicas** personalizables
- **Sincronización con Google Drive** (respaldo y restauración)
- **Exportar / Importar** datos en JSON

## Stack Técnico

| Tecnología | Uso |
|---|---|
| HTML5 | Estructura |
| CSS3 (Glassmorphism) | Estilos con modo oscuro |
| JavaScript (Vanilla) | Lógica modular |
| LocalStorage | Persistencia offline |
| Service Worker | Cache y PWA |
| Google Drive API | Respaldo en la nube |

## Uso

1. Abre `index.html` en un navegador o despliega en GitHub Pages
2. La app funciona completamente offline tras la primera carga
3. Instálala como PWA desde el menú del navegador

## Estructura del proyecto

```
├── index.html          → Entrada principal
├── manifest.json       → Configuración PWA
├── sw.js               → Service Worker
├── css/
│   └── styles.css      → Estilos (dark mode, glassmorphism)
└── js/
    ├── app.js           → Core, navegación, persistencia
    ├── dashboard.js     → Vista de inicio
    ├── movements.js     → Registro de movimientos
    ├── history.js       → Historial filtrable
    ├── debts.js         → Gestión de deudas
    ├── summary.js       → Resumen y presupuestos
    ├── commissions.js   → Comisiones semanales
    ├── goals.js         → Metas de ahorro
    ├── reconciliation.js → Conciliación de cuentas
    └── config.js        → Configuración y cuentas
```

## Licencia

Proyecto personal — Todos los derechos reservados.
