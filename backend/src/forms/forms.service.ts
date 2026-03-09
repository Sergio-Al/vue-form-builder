import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form } from './form.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form)
    private readonly formRepo: Repository<Form>,
  ) {}

  create(dto: CreateFormDto): Promise<Form> {
    const form = this.formRepo.create(dto);
    return this.formRepo.save(form);
  }

  findAll(): Promise<Form[]> {
    return this.formRepo.find({
      select: ['id', 'name', 'description', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Form> {
    const form = await this.formRepo.findOneBy({ id });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async update(id: string, dto: UpdateFormDto): Promise<Form> {
    const form = await this.findOne(id);
    Object.assign(form, dto);
    return this.formRepo.save(form);
  }

  async remove(id: string): Promise<void> {
    const form = await this.findOne(id);
    await this.formRepo.remove(form);
  }
}
