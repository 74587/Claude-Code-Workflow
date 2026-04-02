import { handler } from '../tools/chain-loader.js';

export async function chainLoaderCommand(json?: string): Promise<void> {
  if (!json) {
    console.log('Usage: ccw chain-loader \'{"cmd":"list|inspect|start|next|done|status|content|complete|visualize", ...}\'');
    return;
  }
  const params = JSON.parse(json);
  const result = await handler(params);
  console.log(JSON.stringify(result, null, 2));
}
