# Local face landmark runtime

Source: `@vladmandic/face-api@1.7.15`, https://www.npmjs.com/package/@vladmandic/face-api/v/1.7.15
Upstream: https://github.com/vladmandic/face-api (fork of face-api.js by Vincent Mühler).
License: MIT, distributed alongside these files in `LICENSE`.
The selected tiny detector and tiny 68-point model files were copied unchanged from the same npm package.

npm tarball integrity: `sha512-WDMmK3CfNLo8jylWqMoQgf4nIst3M0fzx1dnac96wv/dvMTN4DxC/Pq1DGtduDk1lktCamQ3MIDXFnvrdHTXDw==`

Only the browser bundle and these two tiny models are shipped. No identity descriptors, identity matching, expression, age or gender models are loaded. The CPU runtime is loaded on demand from this app's own server after selecting a photo. No external inference API is called.

SHA-256 of vendored runtime and model files:

- `9a3442b79acaf4fbc7c2e07b7e2d8f84af9bb3871bf08a69d80304ab00640e9a` — `LICENSE`
- `0160f7af3a8c78cece45c7ecc765383bad74becfd438bb787cdd627b2d6f2cf6` — `face-api-1.7.15.js`
- `9a1a5dd19fd814fd5095c3cb58f8e0d3193b8c5b9a6715b30a69d559aea31ad4` — `models/face_landmark_68_tiny_model-weights_manifest.json`
- `b98e9f2f7da76f8a6dda9741a36ed485b224b889d552de2b2c1bb16217f67bfc` — `models/face_landmark_68_tiny_model.bin`
- `5d1af4849ac48d5b985f4a9b16010c512353ddd6fcc63d50fd0bc9e9e64296e5` — `models/tiny_face_detector_model-weights_manifest.json`
- `b7503ce7df31039b1c43316a9b865cab6a70dd748cc602d3fa28b551503c3871` — `models/tiny_face_detector_model.bin`
