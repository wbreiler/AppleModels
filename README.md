# Apple Spatial Lab

A browser viewer for official Apple device models, with immersive Meta Quest WebXR support.

## View the site

Open the deployed HTTPS URL in Meta Quest Browser. Sign in with the owner account if the site is private. Select a device, wait for the model, and select **Enter Quest VR**.

In VR, hold a grip button near the model to grab it. Release to leave it in place. Use a controller thumbstick horizontally to rotate and vertically to resize. Exit VR through the Quest system controls.

The desktop viewer supports drag rotation, wheel/pinch zoom, size adjustment, and reset. Dimensions come from Apple's USD metadata, in meters. Size 1× preserves the source dimensions.

## Development

```sh
npm ci
npm run dev
npm run build
```

## Refresh Apple's models

The catalog contains 21 official model packages across iPhone, iPad, Mac, and Legacy categories. Legacy includes the 2019 Mac Pro tower, its case-off variant, and the 2019 Pro Display XDR with Pro Stand. The iPhone 18 Pro package shows Pro and Pro Max together. Apple publishes some models with accessories. The linked MacBook Pro model is the 14-inch version. Apple does not link separate 16-inch MacBook Pro or iPhone 16 models on the inspected product pages. The fetch script discovers USDZ links from official Apple product pages. Legacy entries use verified retained Apple asset URLs because their product pages now redirect. It validates the Apple host and package size. Models are retrieved during catalog refresh, then served from the website's own origin to avoid Apple's cross-origin restrictions.

Apple's binary USD files need conversion for reliable browser support. Use Python 3.13 with Pixar's `usd-core` installed:

```sh
python3.13 -m venv .venv
.venv/bin/pip install usd-core==26.8
npm run sync
.venv/bin/python scripts/prepare-models.py
npm run build
```

Downloads are staged under `.model-refresh/`. Existing converted files are reused when the Apple source URL matches. The converter activates the expanded catalog only after all conversions finish. Always complete both refresh commands before deployment. The conversion flattens scene composition, removes editor-only SDR metadata that breaks the browser parser, preserves texture assets, and packages an ASCII layer in a compressed ZIP. It also reprocesses reused converted packages. A partial refresh must not be published. No scheduled refresh is installed. Availability follows Apple's published model links.

## Verification

```sh
npm test
```

The local preview must run on port 5173. The browser test uses Google Chrome on macOS, or the browser executable specified by `CHROME_PATH`. The material check verifies every binding, shader connection, and texture file in the complete catalog. The browser check verifies decoded texture images, actual model geometry, device selection, size, reset, mobile layout, family navigation, WebMCP device selection, VR support detection, and session denial handling. Real Quest session entry and controller tracking still require headset verification.

## Sources

- [Apple iPhone lineup](https://www.apple.com/iphone/)
- [Apple iPad lineup](https://www.apple.com/ipad/)
- [Apple Mac lineup](https://www.apple.com/mac/)
- [Three.js USDLoader](https://threejs.org/docs/pages/USDLoader.html)
- [Meta WebXR overview](https://developers.meta.com/vr/documentation/web/webxr-overview/)

Apple model assets remain Apple's property. This independent viewer does not imply affiliation or asset ownership.
