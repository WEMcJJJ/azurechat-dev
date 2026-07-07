import { Tiktoken, TiktokenModel, encodingForModel } from "js-tiktoken";

export class ChatTokenService{


    private encoder: Tiktoken;

    constructor(model = "gpt-4") {

        try {
            const tiktokenModel = <TiktokenModel>model;
            this.encoder = encodingForModel(tiktokenModel);  // js-tiktoken
        } catch (error) {
            console.warn("Model fallback: using gpt-4 for token counting");
            this.encoder = encodingForModel("gpt-4");  // js-tiktoken
        }
    }

    public getTokenCountFromMessage(message: any){
        const tokenList = this.encoder.encode(message.content || "");
        return tokenList.length;
    }

    public getTokenCountFromHistory(topHistory: any): { role: string, tokens: number }[] {
        let promptTokens = [];

        for (const message of topHistory) {
            const tokenList = this.encoder.encode(message.content || "");
            promptTokens.push({ role: <string>message.role, tokens: <number>tokenList.length });
        }

        return promptTokens;
    }

    public getTokenCount(input: string){
        const tokenList = this.encoder.encode(input);
        return tokenList.length;
    }
}
