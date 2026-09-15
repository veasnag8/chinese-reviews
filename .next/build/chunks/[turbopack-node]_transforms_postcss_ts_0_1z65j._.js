module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/postcss.config.ts { CONFIG => \"[project]/postcss.config.ts [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/node_modules_03rp_fo._.js",
  "chunks/[root-of-the-server]__0bvqc-v._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/postcss.config.ts { CONFIG => \"[project]/postcss.config.ts [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];