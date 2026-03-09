import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from './response.entity';
import { CreateResponseDto } from './dto/create-response.dto';
import { FormsService } from '../forms/forms.service';

@Injectable()
export class ResponsesService {
  constructor(
    @InjectRepository(Response)
    private readonly responseRepo: Repository<Response>,
    private readonly formsService: FormsService,
  ) {}

  async create(dto: CreateResponseDto): Promise<Response> {
    // Validates form exists (throws NotFoundException if not)
    await this.formsService.findOne(dto.formId);
    const response = this.responseRepo.create(dto);
    return this.responseRepo.save(response);
  }

  findByFormId(formId: string): Promise<Response[]> {
    return this.responseRepo.find({
      where: { formId },
      order: { createdAt: 'DESC' },
    });
  }
}
