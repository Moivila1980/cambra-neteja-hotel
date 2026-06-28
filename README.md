# Cambra · Gestió de neteja d'hotel

PWA offline-first per al **control i registre de la neteja d'habitacions d'hotel**. Cada hotel
es configura a la seva manera: pisos, habitacions, personal, assignacions i checklists pròpies.
Sense dependències ni build: HTML + CSS + JavaScript pur. Les dades es guarden **només al
dispositiu** (IndexedDB), funciona sense connexió i es pot **instal·lar** com una app.

## Com executar-la

L'app necessita servir-se per HTTP (no obrir el fitxer directament, pel service worker).

- **Windows:** doble clic a `start.bat` (obre el navegador i serveix a `http://localhost:8731`).
- **Manual:** des d'aquesta carpeta:
  ```
  python -m http.server 8731
  ```
  i obre `http://localhost:8731/index.html`.

Per **instal·lar-la**: obre-la a Chrome/Edge i prem el botó d'instal·lar (capçalera) o
"Afegeix a la pantalla d'inici". A mòbil/tauleta queda com una app a pantalla completa.

**Pantalla completa de l'ordinador:** prem el botó **"Pantalla completa"** de la capçalera
(o l'avís verd que apareix a dalt en obrir-la a l'ordinador, o la tecla **F11**). Així l'app
ocupa tot el monitor i s'amaga la barra del navegador. Torna a prémer el botó per sortir.

## Funcionalitats

### Configuració per hotel (pestanya **Configura**)
- **Idioma:** Català, Español, English i Deutsch (canvi instantani de tota la interfície).
- **Marca:** logo i nom de l'hotel personalitzables (apareixen a la capçalera).
- **Aparença:** personalitza el **color principal** i d'**accent** (paletes + selector lliure),
  el **fons** (Llenç càlid, Blanc net, Gris suau, Sorra o **Fosc**), la **tipografia**
  (Editorial, Modern, Clàssic, Sans net, Sistema) i la **mida del text** (Compacte→Molt gran).
  Botó per restablir per defecte.
- **Pisos:** afegir, reanomenar i eliminar plantes.
- **Habitacions:** una a una o **en sèrie** (numeració automàtica), amb tipus
  (individual, doble, twin, suite, familiar…).
- **Personal:** cambreres amb color identificatiu.
- **Assignació ràpida:** tria una cambrera i **arrossega amb el ratolí/dit** per pintar les
  seves habitacions amb **el color de la cambrera**; botó "Tot el pis" per assignar una planta.
- **Plantilles d'estructura:** desa el plànol de pisos+habitacions amb un nom i **restaura'l**
  sempre que vulguis (a Configura → Estructura).
- **Colors:** paletes àmplies + **selector lliure** (qualsevol color) per a les cambreres i per
  al tema de l'app; fons de color personalitzat per combinar els teus colors.
- **Checklists:** plantilles editables per a neteja **Diària** i de **Sortida**.
- **Dades:** exportar/importar còpia de seguretat (JSON, inclou fotos), dades d'exemple i
  esborrat total.

### Tauler diari (**Tauler**)
- Targeta de progrés del dia (% completat, fetes, pendents, en procés).
- Filtres per **cambrera** i per **estat**.
- Graella d'habitacions per pis amb codi de color d'estat:
  **Brut · En procés · Net · Revisat · No molestar · Fora de servei**.
- Selector de **data** (treballar sobre qualsevol dia).

### Detall d'habitació (toca una habitació)
- Canvi d'estat ràpid i assignació de cambrera.
- Tipus de neteja (**Diària** / **Sortida**) que carrega la checklist corresponent.
- **Checklist** marcable amb progrés.
- **Fotos** (càmera o galeria), comprimides i adjuntes a l'habitació.
- **Notes** de l'habitació.
- **Reportar incidència** directament des de l'habitació.
- **Finalitzar habitació**: un sol toc. Registra l'hora i la cambrera de manera
  **invisible per a la treballadora** (no veu temps ni cronòmetre).

### Incidències (**Incidències**)
- Avaries, **objectes perduts**, neteja, subministraments i altres.
- Categoria, gravetat, habitació/zona, descripció i fotos.
- Estat obert/resolt amb comptador a la navegació.

### Informe per al responsable (**Informe**)
- Avenç global i desglossament per estat i per cambrera (amb temps treballat).
- **Registre de finalitzacions**: hora exacta, habitació, cambrera i durada de cada
  habitació acabada — dades pensades per al responsable de l'hotel.
- **Exportació CSV** de l'informe del dia (obre amb Excel).

## Estructura del projecte

```
neteja-hotel/
├── index.html              # estructura i shell de l'app
├── styles.css              # estètica (hostaleria refinada) + layout responsive/desktop
├── manifest.webmanifest    # metadades PWA
├── sw.js                   # service worker (offline + precache)
├── icons/                  # icones PWA
└── js/
    ├── app.js              # router, navegació, capçalera, pantalla completa, SW
    ├── db.js               # capa IndexedDB (una sola base de dades)
    ├── i18n.js             # multidioma (CA/ES/EN/DE)
    ├── theme.js            # aparença (colors, fons, tipografia, mida)
    ├── store.js            # estat, domini i accions
    ├── ui.js               # helpers DOM, icones, toasts, sheets, càmera
    └── views/
        ├── board.js        # tauler diari
        ├── room.js         # detall i flux de neteja
        ├── incidents.js    # incidències
        ├── setup.js        # configuració
        └── report.js       # informe del responsable
```

## Notes tècniques
- **Privadesa:** tot és local al dispositiu; cap dada surt a internet.
- **Multidispositiu:** per passar dades d'un dispositiu a un altre, fes servir
  Exportar/Importar (Configura → Dades).
- **Disseny:** mòbil-first amb layout d'escriptori a pantalla completa (≥ 860 px:
  navegació lateral + contingut a tot l'ample). Botó de pantalla completa a la capçalera.
