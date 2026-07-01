# Gurunanda Load ID Lookup Format

When the user sends a handwritten/photo list of Gurunanda reference numbers and asks for Load IDs for Excel, search WMS in LT / LT_F1 and return a copy-ready Excel/CSV table.

## Required columns

```csv
Número de foto,Load ID,DN/Order,Customer,Status,Appointment,Carrier,Trailer,Observación
```

## Example from 2026-07-01

```csv
Número de foto,Load ID,DN/Order,Customer,Status,Appointment,Carrier,Trailer,Observación
4415047289,LOAD-5032296,DN-5189997,"GURUNANDA, LLC",LOADING,2026-07-01 12:00,Amazon Freight LTL,,"No hubo match exacto; en WMS aparece como 44150472991 // SP BOL. Validar lectura de la foto."
4415044319,LOAD-5032297,DN-5189995,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"En WMS aparece como 44150443191 // SP BOL"
4415097291,LOAD-5032289,DN-3208970,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"En WMS aparece como 44150972911 // SP BOL"
44152955731,LOAD-5032283,DN-3209005,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
44150960631,LOAD-5032290,DN-3208969,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
44150342461,LOAD-5032298,DN-5189996,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
44150239741,LOAD-5032303,DN-5189998,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
44152877311,LOAD-5032287,DN-3209007,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
44150936361,LOAD-5032293,DN-3208875,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
44150938401,LOAD-5032295,DN-3208872,"GURUNANDA, LLC",NEW,2026-07-01 12:00,Amazon Freight LTL,,"Match exacto"
```

## Notes

- Customer is usually `GURUNANDA, LLC`.
- Carrier for the 2026-07-01 set was `Amazon Freight LTL`.
- Some handwritten numbers may omit or blur the last digit. If WMS only matches a longer SP BOL/reference, show the WMS value in `Observación` and ask the user to validate.
- Keep the output simple and Excel-ready; CSV is preferred.
