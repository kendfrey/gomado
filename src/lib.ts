export interface BoardContents
{
	width: number;
	height: number;
}

const boardContentsCache: WeakMap<HTMLCanvasElement, BoardContents> = new WeakMap();

export function enableAutoRender(canvas: HTMLCanvasElement): () => void
{
	const observer = new ResizeObserver(() =>
	{
		const contents = boardContentsCache.get(canvas);
		if (contents !== undefined)
			drawBoard(canvas, contents);
	});
	observer.observe(canvas);
	return () => observer.disconnect();
}

export function drawBoard(canvas: HTMLCanvasElement, contents: BoardContents)
{
	boardContentsCache.set(canvas, contents);
	const w = canvas.width = canvas.clientWidth * devicePixelRatio;
	const h = canvas.height = canvas.clientHeight * devicePixelRatio;
	const ctx = canvas.getContext("2d")!;
	ctx.clearRect(0, 0, w, h);
	ctx.strokeStyle = "blue";
	ctx.strokeRect(10.5, 10.5, contents.width, contents.height);
}
