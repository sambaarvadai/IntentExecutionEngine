export interface RouteHandler {
    (req: any, res: any): Promise<void>;
}
export interface Router {
    get(path: string, handler: RouteHandler): void;
    patch(path: string, handler: RouteHandler): void;
    post(path: string, handler: RouteHandler): void;
    routes: Map<string, {
        method: string;
        handler: RouteHandler;
    }>;
}
export declare function createRouter(): Router;
export declare const graphRouter: Router;
export default graphRouter;
//# sourceMappingURL=graphs.d.ts.map