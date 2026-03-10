import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  IsArray,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import sanitize from 'sanitize-html';

const stripHtml = (value: string) =>
  sanitize(value, { allowedTags: [], allowedAttributes: {} }).trim();

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? stripHtml(value) : value))
  name: string;

  @IsString()
  @IsOptional()
  @Length(0, 1000)
  @Transform(({ value }) => (typeof value === 'string' ? stripHtml(value) : value))
  description?: string;

  @IsObject()
  @IsNotEmpty()
  schema: Record<string, any>;

  @IsArray()
  @IsOptional()
  rules?: Record<string, any>[];
}
