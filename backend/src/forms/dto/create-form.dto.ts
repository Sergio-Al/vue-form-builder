import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  schema: Record<string, any>;
}
