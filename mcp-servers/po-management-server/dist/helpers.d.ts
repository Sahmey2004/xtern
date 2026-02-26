export declare function jsonResponse(data: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function errorResponse(message: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
