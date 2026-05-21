import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { GlobalContextProviders } from "./components/_globalContextProviders";
import PageLayout_0 from "./pages/login.pageLayout.tsx";
import PageLayout_1 from "./pages/_index.pageLayout.tsx";
import PageLayout_2 from "./pages/aprovacoes.pageLayout.tsx";
import PageLayout_3 from "./pages/solicitacoes.pageLayout.tsx";
import PageLayout_4 from "./pages/minhas-solicitacoes.pageLayout.tsx";
import PageLayout_5 from "./pages/solicitacoes.$solicitacaoId.pageLayout.tsx";
import PageLayout_6 from "./pages/compras-ti.pageLayout.tsx";
import PageLayout_7 from "./pages/trocar-senha.pageLayout.tsx";
import PageLayout_8 from "./pages/admin.usuarios.pageLayout.tsx";

const Page_0 = lazy(() => import("./pages/login.tsx"));
const Page_1 = lazy(() => import("./pages/_index.tsx"));
const Page_2 = lazy(() => import("./pages/aprovacoes.tsx"));
const Page_3 = lazy(() => import("./pages/solicitacoes.tsx"));
const Page_4 = lazy(() => import("./pages/minhas-solicitacoes.tsx"));
const Page_5 = lazy(() => import("./pages/solicitacoes.$solicitacaoId.tsx"));
const Page_6 = lazy(() => import("./pages/compras-ti.tsx"));
const Page_7 = lazy(() => import("./pages/trocar-senha.tsx"));
const Page_8 = lazy(() => import("./pages/admin.usuarios.tsx"));


if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) => {
    setTimeout(cb, 1);
  };
}

import "./base.css";

const fileNameToRoute = new Map([
  ["./pages/login.tsx", "/login"],
  ["./pages/_index.tsx", "/"],
  ["./pages/aprovacoes.tsx", "/aprovacoes"],
  ["./pages/solicitacoes.tsx", "/solicitacoes"],
  ["./pages/minhas-solicitacoes.tsx", "/minhas-solicitacoes"],
  ["./pages/solicitacoes.$solicitacaoId.tsx", "/solicitacoes/:solicitacaoId"],
  ["./pages/compras-ti.tsx", "/compras-ti"],
  ["./pages/trocar-senha.tsx", "/trocar-senha"],
  ["./pages/admin.usuarios.tsx", "/admin/usuarios"],
]);

const fileNameToComponent = new Map<string, React.ComponentType<any>>([
  ["./pages/login.tsx", Page_0 as React.ComponentType<any>],
  ["./pages/_index.tsx", Page_1 as React.ComponentType<any>],
  ["./pages/aprovacoes.tsx", Page_2 as React.ComponentType<any>],
  ["./pages/solicitacoes.tsx", Page_3 as React.ComponentType<any>],
  ["./pages/minhas-solicitacoes.tsx", Page_4 as React.ComponentType<any>],
  ["./pages/solicitacoes.$solicitacaoId.tsx", Page_5 as React.ComponentType<any>],
  ["./pages/compras-ti.tsx", Page_6 as React.ComponentType<any>],
  ["./pages/trocar-senha.tsx", Page_7 as React.ComponentType<any>],
  ["./pages/admin.usuarios.tsx", Page_8 as React.ComponentType<any>],
]);

function RouteLoadingFallback() {
  return <div style={{ minHeight: "20vh" }} />;
}

function makePageRoute(filename: string) {
  const Component = fileNameToComponent.get(filename);
  if (!Component) return null;

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Component />
    </Suspense>
  );
}

function toElement({
  trie,
  fileNameToRoute,
  makePageRoute,
}: {
  trie: LayoutTrie;
  fileNameToRoute: Map<string, string>;
  makePageRoute: (filename: string) => React.ReactNode;
}) {
  return [
    ...trie.topLevel.map((filename) => (
      <Route
        key={fileNameToRoute.get(filename)}
        path={fileNameToRoute.get(filename)}
        element={makePageRoute(filename)}
      />
    )),
    ...Array.from(trie.trie.entries()).map(([Component, child], index) => (
      <Route
        key={index}
        element={
          <Component>
            <Outlet />
          </Component>
        }
      >
        {toElement({ trie: child, fileNameToRoute, makePageRoute })}
      </Route>
    )),
  ];
}

type LayoutTrieNode = Map<
  React.ComponentType<{ children: React.ReactNode }>,
  LayoutTrie
>;

type LayoutTrie = {
  topLevel: string[];
  trie: LayoutTrieNode;
};

function buildLayoutTrie(layouts: {
  [fileName: string]: React.ComponentType<{ children: React.ReactNode }>[];
}): LayoutTrie {
  const result: LayoutTrie = { topLevel: [], trie: new Map() };

  Object.entries(layouts).forEach(([fileName, components]) => {
    let cur: LayoutTrie = result;

    for (const component of components) {
      if (!cur.trie.has(component)) {
        cur.trie.set(component, {
          topLevel: [],
          trie: new Map(),
        });
      }

      cur = cur.trie.get(component)!;
    }

    cur.topLevel.push(fileName);
  });

  return result;
}

function NotFound() {
  return (
    <div>
      <h1>Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>
        Go back to the{" "}
        <a href="/" style={{ color: "blue" }}>
          home page
        </a>
        .
      </p>
    </div>
  );
}

import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === "POP") return;
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, hash, navType]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <GlobalContextProviders>
        <Routes>
          {toElement({
            trie: buildLayoutTrie({
              "./pages/login.tsx": PageLayout_0,
              "./pages/_index.tsx": PageLayout_1,
              "./pages/aprovacoes.tsx": PageLayout_2,
              "./pages/solicitacoes.tsx": PageLayout_3,
              "./pages/minhas-solicitacoes.tsx": PageLayout_4,
              "./pages/solicitacoes.$solicitacaoId.tsx": PageLayout_5,
              "./pages/compras-ti.tsx": PageLayout_6,
              "./pages/trocar-senha.tsx": PageLayout_7,
              "./pages/admin.usuarios.tsx": PageLayout_8,
            }),
            fileNameToRoute,
            makePageRoute,
          })}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </GlobalContextProviders>
    </BrowserRouter>
  );
}
