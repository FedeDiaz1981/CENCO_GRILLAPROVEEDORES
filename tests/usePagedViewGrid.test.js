const React = require("react");
const ReactDOM = require("react-dom");
const { act } = require("react-dom/test-utils");
const { usePagedViewGrid } = require("../lib/webparts/cencoPdpGrillaProvVehiculos/hooks/usePagedViewGrid");

function HookHarness(props) {
  const state = usePagedViewGrid(props.getPaged, props.opts);

  React.useEffect(() => {
    props.onUpdate(state);
  });

  return null;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("usePagedViewGrid", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    container = null;
  });

  test("carga la primera pagina y avanza a la siguiente", async () => {
    const getPaged = jest
      .fn()
      .mockResolvedValueOnce({
        columns: [{ key: "Title", name: "Title", fieldName: "Title" }],
        items: [{ Id: 1, Title: "Uno" }],
        nextToken: "token-1",
      })
      .mockResolvedValueOnce({
        columns: [{ key: "Title", name: "Title", fieldName: "Title" }],
        items: [{ Id: 2, Title: "Dos" }],
        nextToken: undefined,
      });

    let latest;

    await act(async () => {
      ReactDOM.render(
        React.createElement(HookHarness, {
          getPaged,
          opts: {
            viewId: "view-1",
            toggleField: "Activo",
            fetchBatch: 1,
            uiPageSize: 1,
            prefetchThreshold: 0,
            timeoutMs: 2000,
          },
          onUpdate: (state) => {
            latest = state;
          },
        }),
        container
      );

      await flush();
    });

    expect(getPaged).toHaveBeenCalledTimes(1);
    expect(latest.loading).toBe(false);
    expect(latest.pageItems).toHaveLength(1);
    expect(latest.pageItems[0].Id).toBe(1);
    expect(latest.canGoNext).toBe(true);

    await act(async () => {
      await latest.goNext();
      await flush();
    });

    expect(getPaged).toHaveBeenCalledTimes(2);
    expect(latest.pageIndex).toBe(1);
    expect(latest.pageItems).toHaveLength(1);
    expect(latest.pageItems[0].Id).toBe(2);
  });
});
