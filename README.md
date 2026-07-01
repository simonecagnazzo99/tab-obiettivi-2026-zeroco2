# Tab obiettivi 2026 zeroCO2

Dashboard web statica, mobile-first, pensata per mostrare gli obiettivi 2026 di zeroCO2 con dati provenienti da Google Sheets.

## Funzionamento

- La pagina mostra 6 card con avanzamento e barra di progresso.
- La card BU1 espande il dettaglio delle fatture da un foglio dedicato.
- Gli aggiornamenti vengono letti da Google Sheets senza modificare il codice.
- La pagina mostra un timestamp dell'ultimo aggiornamento e un pulsante di refresh manuale.
- L'accesso è protetto da una password condivisa tramite una funzione Netlify.

## Configurazione dati

1. Crea un Google Sheet pubblico in sola lettura.
2. Aggiungi due fogli:
   - obiettivi
   - bu1_dettaglio
3. Copia i dati indicati nel prompt nel foglio corretto.
4. Pubblica il foglio come CSV/Google Visualization API.

### URL utili

Per Google Sheets puoi usare il formato:

- https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=obiettivi
- https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=bu1_dettaglio

Aggiungili in [config.js](config.js) nella sezione dataSources.

## Aggiornare i numeri

- Modifica i valori nel foglio Google Sheets.
- Il sito li legge al caricamento e con il pulsante Aggiorna.
- Non serve toccare il codice.

## Aggiungere righe al breakdown BU1

- Aggiungi una nuova riga nel foglio bu1_dettaglio.
- Il layout mostrerà automaticamente la nuova voce.
- Se vuoi il target della singola voce, inserisci anche la colonna target.

## Cambiare la password

- Modifica il valore sharedPassword in [config.json](config.json).
- Oppure imposta la variabile d'ambiente SHARED_PASSWORD nel pannello Netlify.

### Protezione più forte su Netlify

Per protezione reale, attiva la Password protection nativa di Netlify (piano a pagamento) sul sito pubblicato.

## Deploy su Netlify

1. Crea un nuovo sito Netlify collegando questo repository.
2. Imposta la directory di pubblicazione come la root del progetto.
3. Netlify rileverà automaticamente la funzione serverless in netlify/functions.
4. Aggiungi la variabile d'ambiente SHARED_PASSWORD con la password desiderata.
5. Pubblica il sito.

## Struttura principali

- [index.html](index.html)
- [styles.css](styles.css)
- [app.js](app.js)
- [config.js](config.js)
- [config.json](config.json)
- [netlify/functions/verify-password.js](netlify/functions/verify-password.js)
