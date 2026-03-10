import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from './response.entity';
import { CreateResponseDto } from './dto/create-response.dto';
import { FormsService } from '../forms/forms.service';
import {
  validateResponseData,
  sanitizeResponseData,
} from './validate-response';
import type { Rule } from './evaluate-conditions';

@Injectable()
export class ResponsesService {
  constructor(
    @InjectRepository(Response)
    private readonly responseRepo: Repository<Response>,
    private readonly formsService: FormsService,
  ) {}

  async create(dto: CreateResponseDto): Promise<Response> {
    // Validates form exists (throws NotFoundException if not)
    const form = await this.formsService.findOne(dto.formId);

    // Validate & sanitize response data against form schema + rules
    const validatedData = validateResponseData(form.schema, dto.data, (form.rules ?? []) as Rule[]);
    const cleanData = sanitizeResponseData(validatedData);

    const response = this.responseRepo.create({
      formId: dto.formId,
      data: cleanData,
    });
    return this.responseRepo.save(response);
  }

  findByFormId(formId: string): Promise<Response[]> {
    return this.responseRepo.find({
      where: { formId },
      order: { createdAt: 'DESC' },
    });
  }
}
