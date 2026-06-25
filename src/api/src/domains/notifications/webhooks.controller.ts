import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../core/auth/public.decorator.js";
import { InboundMessageHandler } from "./inbound-message.handler.js";

@ApiTags("Webhooks")
@Controller({ path: "webhooks", version: "1" })
export class WebhooksController {
  constructor(private readonly inbound: InboundMessageHandler) {}

  @Public()
  @Post("twilio/sms")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Twilio inbound SMS webhook" })
  @ApiResponse({ status: 200, description: "Webhook accepted" })
  @ApiResponse({ status: 403, description: "Invalid signature" })
  async twilioSms(
    @Req() req: Request,
    @Headers("x-twilio-signature") signature: string,
    @Res() res: Response,
  ): Promise<void> {
    const payload = (req.body ?? {}) as Record<string, string>;
    const twiml = await this.inbound.handleTwilioSms(payload, signature ?? "");
    if (twiml) {
      res.type("text/xml").send(twiml);
    } else {
      res.status(200).send();
    }
  }

  @Public()
  @Post("resend/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend inbound email webhook" })
  @ApiResponse({ status: 200, description: "Webhook accepted" })
  @ApiResponse({ status: 403, description: "Invalid signature" })
  async resendInbound(
    @Body() payload: unknown,
    @Headers() headers: Record<string, string>,
  ): Promise<void> {
    await this.inbound.handleResendInbound(payload, headers);
  }
}
