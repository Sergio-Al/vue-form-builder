import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ResponsesService } from './responses.service';
import { CreateResponseDto } from './dto/create-response.dto';

@Controller('api')
export class ResponsesController {
  constructor(private readonly responsesService: ResponsesService) {}

  @Post('responses')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  create(@Body() dto: CreateResponseDto) {
    return this.responsesService.create(dto);
  }

  @Get('forms/:id/responses')
  findByForm(@Param('id', ParseUUIDPipe) id: string) {
    return this.responsesService.findByFormId(id);
  }
}
